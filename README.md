# GPT Cloud Function

[![build](https://github.com/entroped/gpt-cloud-function/actions/workflows/npm-build-test.yml/badge.svg)](https://github.com/entroped/gpt-cloud-function/actions/workflows/npm-build-test.yml)

GCP HTTP Function to communicate with custom OpenAI GPT Assistant.
This repository provides an example to create an assistant with knowledge base, faq and general information about its identity.
It is perfectly suitable to use as a Customer Support.

## Getting Started

### Retrieving OpenAI API Key
 - Go to [Openai API Keys](https://platform.openai.com/api-keys) page and create an API key for this project
   - Permissions should be write to Assistants, Threads, and Files.
 - Add your API key into .env file
    ```bash
    OPENAI_API_KEY=Your API KEY
   ```
    - (Optional) - You can use Google Cloud Key Management Service to handle .env variables in the cloud


### Local Testing

Use your own package manager to install and test locally with the **start** npm command. (_pnpm recommended_)

```bash
npm install
npm run build
npm run start
```


### Cloud Testing

#### Install
 - Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (known as Cloud CDK)
   - `gcloud init`
 - Create a project and set it as your default project 
   - `gcloud config set project YOUR_PROJECT_ID`

#### Deploy
```bash
npm install
npm run build
npm run gcp-deploy
```

### Using the API

You can use the function at http://localhost:8080/ locally and/or with your Cloud Function Public URL via HTTP Post methods.

- [OpenAPI 3 Documentation](./docs/openapi.yaml)
- [Example Postman Collection](./docs/gpt-cloud-function.postman_collection.json)

#### Steps

Initially you will need to send an starting message to the Assistant with the following format:
```json
{
   "content": "Tell me about Quick Chat API"
}
```

The answer will have the **threadId**, **status**, **runId** and the **result** array with the message thread.


```json
{
   "result": [
      {
         "id": "string",
         "object": "string",
         "created_at": 0,
         "assistant_id": "string",
         "thread_id": "string",
         "run_id": "string",
         "role": "assistant",
         "content": [
            {
               "type": "text",
               "text": {
                  "value": "Hi, I am happy to help.",
                  "annotations": []
               }
            },
            {
               "type": "text",
               "text": {
                  "value": "Tell me about Quick Chat API",
                  "annotations": []
               }
            }
         ],
         "attachments": [],
         "metadata": {}
      }
   ],
   "threadId": "string",
   "status": "string",
   "runId": "string"
}
```

Extract the threadId, and use it in the next message from now on to continue the conversation.

```json
{
"content": "This is my second question",
"threadId": "{{threadId}}"
}
```

## Contribute

There are many ways to [contribute](https://github.com/entroped/gpt-cloud-function/blob/main/CONTRIBUTING.md) to GPT Cloud Functions.
* [Submit bugs](https://github.com/entroped/gpt-cloud-function/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/entroped/gpt-cloud-function/pulls).
* [Contribute bug fixes](https://github.com/entroped/gpt-cloud-function/blob/main/CONTRIBUTING.md).

