# Security Group
resource "aws_security_group" "main" {
  name        = var.name
  description = var.description
  vpc_id      = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name = var.name
    }
  )
}

# Ingress Rules
resource "aws_security_group_rule" "ingress" {
  count = length(var.ingress_rules)

  type              = "ingress"
  description       = var.ingress_rules[count.index].description
  from_port         = var.ingress_rules[count.index].from_port
  to_port           = var.ingress_rules[count.index].to_port
  protocol          = var.ingress_rules[count.index].protocol
  cidr_blocks       = var.ingress_rules[count.index].cidr_blocks
  security_group_id = aws_security_group.main.id
}

# Egress Rules
resource "aws_security_group_rule" "egress" {
  count = length(var.egress_rules)

  type              = "egress"
  description       = var.egress_rules[count.index].description
  from_port         = var.egress_rules[count.index].from_port
  to_port           = var.egress_rules[count.index].to_port
  protocol          = var.egress_rules[count.index].protocol
  cidr_blocks       = var.egress_rules[count.index].cidr_blocks
  security_group_id = aws_security_group.main.id
}

