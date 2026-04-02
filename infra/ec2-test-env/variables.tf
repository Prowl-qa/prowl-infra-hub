variable "aws_region" {
  description = "AWS region for test infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "Prowl-qa"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "prowl-infra-hub"
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
