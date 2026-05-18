terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_tag
      ManagedBy = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# GitHub Actions OIDC Provider
# Allows GitHub Actions to assume IAM roles without static credentials.
# -----------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# -----------------------------------------------------------------------------
# IAM Role for GitHub Actions
# Scoped to specific repo, restricted to allowed instance types.
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:${var.github_ref}"]
    }
  }
}

resource "aws_iam_role" "molecule_test" {
  name               = "prowl-molecule-gh-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "molecule_ec2" {
  # EC2 instance lifecycle
  statement {
    sid    = "EC2InstanceLifecycle"
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceStatus",
      "ec2:DescribeImages",
      "ec2:DescribeKeyPairs",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcs",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "EC2TerminateProjectInstances"
    effect    = "Allow"
    actions   = ["ec2:TerminateInstances"]
    resources = ["arn:aws:ec2:*:*:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "ec2:ResourceTag/Project"
      values   = ["ec2-test-env"]
    }
  }

  statement {
    sid       = "EC2TagProjectInstances"
    effect    = "Allow"
    actions   = ["ec2:CreateTags"]
    resources = ["arn:aws:ec2:*:*:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/Project"
      values   = ["ec2-test-env"]
    }

    condition {
      test     = "StringEquals"
      variable = "ec2:CreateAction"
      values   = ["RunInstances"]
    }

    condition {
      test     = "ForAllValues:StringEquals"
      variable = "aws:TagKeys"
      # "Name" is set by amazon.aws.ec2_instance's `name:` parameter, which
      # we use to identify each Molecule test instance.
      values   = ["Project", "RunId", "environment", "managed-by", "prowl-test", "Name"]
    }
  }

  # Restrict instance types that can be launched
  statement {
    sid       = "RestrictInstanceTypes"
    effect    = "Deny"
    actions   = ["ec2:RunInstances"]
    resources = ["arn:aws:ec2:*:*:instance/*"]

    condition {
      test     = "ForAnyValue:StringNotEquals"
      variable = "ec2:InstanceType"
      values   = var.allowed_instance_types
    }
  }

  # Restrict to spot instances only (cost control)
  statement {
    sid       = "RequireSpotInstances"
    effect    = "Deny"
    actions   = ["ec2:RunInstances"]
    resources = ["arn:aws:ec2:*:*:instance/*"]

    condition {
      test     = "StringNotEquals"
      variable = "ec2:InstanceMarketType"
      values   = ["spot"]
    }
  }
}

resource "aws_iam_role_policy" "molecule_ec2" {
  name   = "prowl-molecule-ec2-access"
  role   = aws_iam_role.molecule_test.id
  policy = data.aws_iam_policy_document.molecule_ec2.json
}

# -----------------------------------------------------------------------------
# VPC + Subnet (dedicated to testing, isolated from any production resources)
# -----------------------------------------------------------------------------

resource "aws_vpc" "test" {
  cidr_block           = "10.200.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "prowl-test-vpc" }
}

resource "aws_internet_gateway" "test" {
  vpc_id = aws_vpc.test.id
  tags   = { Name = "prowl-test-igw" }
}

resource "aws_subnet" "test" {
  vpc_id                  = aws_vpc.test.id
  cidr_block              = "10.200.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[0]

  tags = { Name = "prowl-test-subnet" }
}

resource "aws_route_table" "test" {
  vpc_id = aws_vpc.test.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.test.id
  }

  tags = { Name = "prowl-test-rt" }
}

resource "aws_route_table_association" "test" {
  subnet_id      = aws_subnet.test.id
  route_table_id = aws_route_table.test.id
}

data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# Security Group — SSH ingress only, all egress
# -----------------------------------------------------------------------------

resource "aws_security_group" "molecule" {
  name        = "prowl-molecule-sg"
  description = "Allow SSH for Molecule playbook testing"
  vpc_id      = aws_vpc.test.id

  # Intentional exception for AWS-0107 and AWS-0104: this security group is
  # limited to an isolated test VPC used only by ephemeral CI-launched
  # instances. SSH ingress from 0.0.0.0/0 is required because GitHub-hosted
  # runners have dynamic public IPs, and unrestricted egress keeps disposable
  # Molecule test instances functional during CI runs.
  ingress {
    description = "SSH from anywhere (ephemeral CI runners)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "prowl-molecule-sg" }
}

# -----------------------------------------------------------------------------
# SSH Key Pair — public key supplied externally, private key stays outside Terraform
# -----------------------------------------------------------------------------

resource "aws_key_pair" "molecule" {
  key_name   = "prowl-molecule-key"
  public_key = var.molecule_public_key
}
