# -----------------------------------------------------------------------------
# Values to copy into GitHub Secrets (Settings > Secrets and variables > Actions)
# Generate the ED25519 key locally and store the private key in GitHub Secrets;
# Terraform now manages only the public key registration in AWS.
# -----------------------------------------------------------------------------

output "aws_role_arn" {
  description = "GitHub Secret: AWS_ROLE_ARN — OIDC role for GitHub Actions"
  value       = aws_iam_role.molecule_test.arn
}

output "ec2_subnet_id" {
  description = "GitHub Secret: EC2_SUBNET_ID — Subnet for test instances"
  value       = aws_subnet.test.id
}

output "ec2_security_group_id" {
  description = "GitHub Secret: EC2_SECURITY_GROUP_ID — SG allowing SSH"
  value       = aws_security_group.molecule.id
}

output "ec2_key_pair_name" {
  description = "GitHub Secret: EC2_KEY_PAIR_NAME — AWS key pair name"
  value       = aws_key_pair.molecule.key_name
}

# -----------------------------------------------------------------------------
# Reference info (not secrets, just for your records)
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID for the test environment"
  value       = aws_vpc.test.id
}

output "aws_region" {
  description = "AWS region where resources were created"
  value       = var.aws_region
}

output "iam_role_name" {
  description = "Name of the IAM role (for console reference)"
  value       = aws_iam_role.molecule_test.name
}
