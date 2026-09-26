# Cheapest Doc AI public deploy: Lambda + Function URL (no EC2/App Runner required)
$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:AWS_DEFAULT_REGION = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "us-east-1" }
$env:AWS_REGION = $env:AWS_DEFAULT_REGION
$Region = $env:AWS_DEFAULT_REGION
$Fn = "doc-ai-mcp"
$RoleName = "doc-ai-lambda-role"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

Write-Host "Building Lambda zip..."
npm run build:lambda

$Account = aws sts get-caller-identity --query Account --output text
$RoleArn = "arn:aws:iam::${Account}:role/${RoleName}"

$trust = @'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
'@
$trustPath = Join-Path $env:TEMP "doc-ai-trust.json"
Set-Content -Path $trustPath -Value $trust -Encoding ascii

aws iam get-role --role-name $RoleName 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating IAM role $RoleName"
  aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustPath" | Out-Null
  aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole | Out-Null
  Start-Sleep -Seconds 8
}

$zip = Join-Path $Root "dist-lambda.zip"
$envJson = '[{"name":"HOST","value":"0.0.0.0"},{"name":"PORT","value":"8790"},{"name":"DOC_AI_DB","value":"/tmp/doc-ai.sqlite"},{"name":"GROK_MODEL","value":"grok-4-fast-non-reasoning"},{"name":"XAI_MODEL","value":"grok-4-fast-non-reasoning"},{"name":"ALLOWED_ORIGINS","value":"https://whatsupdoc.fyi,https://www.whatsupdoc.fyi,https://api.whatsupdoc.fyi"}]'

aws lambda get-function --function-name $Fn --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating function $Fn"
  aws lambda create-function `
    --function-name $Fn `
    --runtime nodejs22.x `
    --role $RoleArn `
    --handler index.handler `
    --zip-file "fileb://$zip" `
    --timeout 30 `
    --memory-size 512 `
    --architectures arm64 `
    --environment "Variables={HOST=0.0.0.0,PORT=8790,DOC_AI_DB=/tmp/doc-ai.sqlite,GROK_MODEL=grok-4-fast-non-reasoning,XAI_MODEL=grok-4-fast-non-reasoning,ALLOWED_ORIGINS=https://whatsupdoc.fyi,https://www.whatsupdoc.fyi,https://api.whatsupdoc.fyi}" `
    --region $Region | Out-Null
} else {
  Write-Host "Updating function code $Fn"
  aws lambda update-function-code --function-name $Fn --zip-file "fileb://$zip" --region $Region | Out-Null
  Start-Sleep -Seconds 3
  aws lambda update-function-configuration `
    --function-name $Fn `
    --timeout 30 `
    --memory-size 512 `
    --environment "Variables={HOST=0.0.0.0,PORT=8790,DOC_AI_DB=/tmp/doc-ai.sqlite,GROK_MODEL=grok-4-fast-non-reasoning,XAI_MODEL=grok-4-fast-non-reasoning,ALLOWED_ORIGINS=https://whatsupdoc.fyi,https://www.whatsupdoc.fyi,https://api.whatsupdoc.fyi}" `
    --region $Region | Out-Null
}

# Function URL
$existing = aws lambda get-function-url-config --function-name $Fn --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating Function URL"
  aws lambda create-function-url-config `
    --function-name $Fn `
    --auth-type NONE `
    --cors "AllowOrigins=*,AllowMethods=*,AllowHeaders=*,ExposeHeaders=mcp-session-id,MaxAge=86400" `
    --region $Region | Out-Null
  aws lambda add-permission `
    --function-name $Fn `
    --statement-id FunctionURLAllowPublicAccess `
    --action lambda:InvokeFunctionUrl `
    --principal "*" `
    --function-url-auth-type NONE `
    --region $Region 2>$null | Out-Null
}

$url = aws lambda get-function-url-config --function-name $Fn --region $Region --query FunctionUrl --output text
Write-Host "DOC_AI_URL=$url"
Write-Host "Health: ${url}health"
Write-Host "MCP:    ${url}mcp"
Write-Host "UI:     $url"
Set-Content -Path (Join-Path $Root "deploy\last-lambda-url.txt") -Value $url.Trim()
