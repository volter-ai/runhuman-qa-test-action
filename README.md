# RunHuman QA Test Action

GitHub Action for human-powered QA testing in CI/CD pipelines.

## Features

- 🧪 **Human Testing** - Real humans test your app
- ⚡ **Synchronous** - Blocks until test completes (up to 10 minutes)
- 📊 **Structured Results** - Get structured data back
- 🚫 **Fail Fast** - Automatically fails workflow if test fails
- 📝 **Rich Summaries** - Beautiful GitHub Actions job summaries

## Quick Start

```yaml
- name: Run QA Test
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: https://myapp.com/login
    description: |
      Test login functionality:
      1. Try logging in with valid credentials
      2. Try with invalid password
      3. Verify error messages display correctly
    output-schema: |
      {
        "loginWorks": {
          "type": "boolean",
          "description": "Does login work with valid credentials?"
        },
        "errorHandling": {
          "type": "string",
          "description": "How are errors displayed?"
        }
      }
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ Yes | - | RunHuman API key (get from [runhuman.com/playground](https://runhuman.com/playground)) |
| `url` | ✅ Yes | - | URL to test (must be publicly accessible) |
| `description` | ✅ Yes | - | Test instructions for human tester |
| `output-schema` | ✅ Yes | - | JSON schema defining expected output |
| `api-url` | No | `https://runhuman.com` | RunHuman API base URL |
| `target-duration-minutes` | No | `5` | Target test duration (1-60) |
| `allow-duration-extension` | No | `false` | Allow tester to request more time |
| `max-extension-minutes` | No | - | Maximum extension minutes |
| `fail-on-error` | No | `true` | Fail workflow if test fails |

## Outputs

| Output | Description |
|--------|-------------|
| `status` | Job status (completed, error, etc.) |
| `success` | Boolean - true if test passed |
| `result` | Full result object as JSON |
| `explanation` | Tester's findings |
| `data` | Extracted data as JSON |
| `cost-usd` | Test cost in USD |
| `duration-seconds` | Test duration in seconds |
| `job-id` | Job ID for reference |

## Examples

### Basic Usage

```yaml
- name: Test Homepage
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: https://myapp.com
    description: Check that homepage loads and displays correctly
    output-schema: |
      {
        "pageLoads": {
          "type": "boolean",
          "description": "Does page load?"
        }
      }
```

### Using Test Results

```yaml
- name: Run QA Test
  id: qa-test
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: https://myapp.com/checkout
    description: Test checkout flow
    output-schema: |
      {
        "checkoutWorks": { "type": "boolean", "description": "Works?" },
        "issues": { "type": "string", "description": "Any issues?" }
      }

- name: Process Results
  run: |
    echo "Test succeeded: ${{ steps.qa-test.outputs.success }}"
    echo "Cost: ${{ steps.qa-test.outputs.cost-usd }}"
    echo "Explanation: ${{ steps.qa-test.outputs.explanation }}"
```

### Conditional Testing

```yaml
- name: QA Test (Production Only)
  if: github.ref == 'refs/heads/main'
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: ${{ secrets.PRODUCTION_URL }}
    description: Smoke test production deployment
    output-schema: |
      {
        "productionHealthy": {
          "type": "boolean",
          "description": "Is production healthy?"
        }
      }
```

### Complex Test with Extended Time

```yaml
- name: Comprehensive E2E Test
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: https://myapp.com
    description: |
      Complete end-to-end test:
      1. Sign up for new account
      2. Complete onboarding flow
      3. Create a project
      4. Invite team member
      5. Test all major features
    output-schema: |
      {
        "signupWorks": { "type": "boolean", "description": "Signup successful?" },
        "onboardingWorks": { "type": "boolean", "description": "Onboarding complete?" },
        "projectCreationWorks": { "type": "boolean", "description": "Can create project?" },
        "invitationWorks": { "type": "boolean", "description": "Can invite users?" },
        "issues": { "type": "string", "description": "Any issues found?" }
      }
    target-duration-minutes: 10
    allow-duration-extension: true
    max-extension-minutes: 5
```

### Don't Fail Workflow on Test Failure

```yaml
- name: QA Test (Non-Blocking)
  uses: runhuman/qa-test-action@v1
  with:
    api-key: ${{ secrets.RUNHUMAN_API_KEY }}
    url: https://myapp.com
    description: Test new experimental feature
    output-schema: |
      {
        "featureWorks": { "type": "boolean", "description": "Does it work?" }
      }
    fail-on-error: false  # Don't block deployment on failure
```

## Complete CI/CD Example

```yaml
name: CI with Human QA

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Deploy to staging
        run: npm run deploy:staging
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}

      - name: Wait for deployment
        run: sleep 30

      - name: Human QA Test
        id: qa-test
        uses: runhuman/qa-test-action@v1
        with:
          api-key: ${{ secrets.RUNHUMAN_API_KEY }}
          url: ${{ secrets.STAGING_URL }}
          description: |
            Test the staging deployment:
            1. Navigate to homepage
            2. Click "Sign Up" button
            3. Fill out registration form
            4. Verify confirmation message appears
            5. Check for any visual issues
          output-schema: |
            {
              "homepageLoads": {
                "type": "boolean",
                "description": "Does homepage load successfully?"
              },
              "signupWorks": {
                "type": "boolean",
                "description": "Does signup process complete?"
              },
              "visualIssues": {
                "type": "string",
                "description": "Any visual issues found (or 'None')?"
              },
              "overallSuccess": {
                "type": "boolean",
                "description": "Is the deployment ready for production?"
              }
            }
          target-duration-minutes: 8

      - name: Report Results
        if: always()
        run: |
          echo "QA Test Status: ${{ steps.qa-test.outputs.status }}"
          echo "Test Passed: ${{ steps.qa-test.outputs.success }}"
          echo "Cost: ${{ steps.qa-test.outputs.cost-usd }}"
          echo "Duration: ${{ steps.qa-test.outputs.duration-seconds }}s"

      - name: Deploy to Production
        if: steps.qa-test.outputs.success == 'true'
        run: npm run deploy:production
```

## Pricing

- **Cost**: $0.0018 per second of testing time
- **Average test**: ~3-5 minutes (~$0.32-$0.54)
- **Billing**: Charged to your RunHuman account

## Security

- **Store API key as secret**: Go to Settings → Secrets → Actions → New repository secret
- **Never commit API keys**: API keys should only be stored as GitHub secrets
- **API key format**: Production keys start with `qa_live_`

### Setting up your API key:

1. Get your API key from [runhuman.com/playground](https://runhuman.com/playground)
2. In your GitHub repository, go to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `RUNHUMAN_API_KEY`
5. Value: Your API key (starts with `qa_live_`)
6. Click "Add secret"

## How It Works

1. **Action starts**: Your workflow triggers the RunHuman action
2. **Job created**: A test job is created and sent to human testers
3. **Tester claims**: A qualified tester claims your test
4. **Testing**: The tester follows your instructions and tests your app
5. **Results extracted**: AI extracts structured data from tester's findings
6. **Workflow continues**: Your workflow receives the results and continues

The action **blocks** (waits synchronously) until the test completes or times out after 10 minutes.

## Output Schema

The `output-schema` defines what structured data you want extracted from the test. It should be a JSON object where each field has:

- `type`: Data type (`boolean`, `string`, `number`, `object`, `array`)
- `description`: What the field represents

Example:
```json
{
  "loginWorks": {
    "type": "boolean",
    "description": "Can user log in with valid credentials?"
  },
  "errorMessage": {
    "type": "string",
    "description": "What error message appears for invalid login?"
  },
  "loginTime": {
    "type": "number",
    "description": "How many seconds does login take?"
  }
}
```

## Troubleshooting

### Authentication Error

```
Error: Authentication failed: Invalid API key
```

**Solution**: Check that your `RUNHUMAN_API_KEY` secret is set correctly and starts with `qa_live_`

### Timeout Error

```
Error: Test timeout: Test did not complete within 10 minutes
```

**Solution**: This means no tester was available or the test took too long. Try:
- Increasing `target-duration-minutes`
- Simplifying your test description
- Retrying during peak hours

### Network Error

```
Error: Network error: Cannot reach RunHuman API
```

**Solution**: Check your `api-url` input. Default is `https://runhuman.com`

### Invalid Schema Error

```
Error: Invalid output-schema: Must be valid JSON
```

**Solution**: Check that your `output-schema` is valid JSON. Use a JSON validator to verify syntax.

## Support

- **Documentation**: [runhuman.com/docs](https://runhuman.com/docs)
- **Get API key**: [runhuman.com/playground](https://runhuman.com/playground)
- **Contact**: runhuman@volter.ai

## License

ISC
