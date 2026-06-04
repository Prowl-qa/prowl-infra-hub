variable "aws_region" {
  description = "AWS region for test infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "prowl-tools"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "prowl-infra-hub"
}

variable "github_ref" {
  description = "Git ref allowed to assume the GitHub Actions OIDC role"
  type        = string
  default     = "refs/heads/main"
}

variable "allowed_instance_types" {
  description = "EC2 instance types the test role is allowed to launch"
  type        = list(string)
  default     = ["t3.micro", "t3.small", "t3.medium"]
}

variable "project_tag" {
  description = "Tag applied to all resources for identification and cleanup"
  type        = string
  default     = "prowl-infra-test"
}

variable "molecule_public_key" {
  description = "ED25519 public key for the EC2 test key pair. Generate locally and pass via -var or tfvars; store the private key outside Terraform."
  type        = string
}
