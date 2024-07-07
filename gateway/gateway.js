// NOTE: This file is for testing purposes only
const fs = require('fs');
const { execSync } = require('child_process');
const yaml = require('yaml');

// Function to get the current GCP project ID
function getGCPProjectID() {
    try {
        return execSync('gcloud config get-value project', {encoding: 'utf8'}).trim();
    } catch (error) {
        console.error('Error getting GCP project ID:', error);
        process.exit(1);
    }
}

// Function to create the OpenAPI spec
// Function to create the Swagger spec
function createSwaggerSpec(projectId) {
    const swaggerSpec = {
        swagger: '2.0',
        info: {
            title: 'gpt-api',
            description: 'Connect GPT Function with the clients',
            version: '2.0.0'
        },
        schemes: ['https'],
        produces: ['application/json'],
        paths: {
            '/chat': {
                post: {
                    summary: 'Send a message to the server',
                    description: 'Send a message to the server',
                    operationId: 'sendMessage',
                    'x-google-backend': {
                        address: `https://us-central1-${projectId}.cloudfunctions.net/gpt-cloud-function`
                    },
                    responses: {
                        '200': {
                            description: 'Server response'
                        }
                    },
                    security: [
                        {
                            api_key: []
                        }
                    ]
                }
            }
        },
        securityDefinitions: {
            api_key: {
                type: 'apiKey',
                name: 'key',
                in: 'query'
            }
        }
    };

    return yaml.stringify(swaggerSpec);
}


// Function to check if the gateway exists
function checkGatewayExists(gatewayId, projectId, location) {
    try {
        execSync(`gcloud api-gateway gateways describe ${gatewayId} --location=${location} --project=${projectId}`, { encoding: 'utf8' });
        return true;
    } catch (error) {
        return false;
    }
}

// Function to check if the API config exists
function checkAPIConfigExists(apiId, configId, projectId) {
    try {
        execSync(`gcloud api-gateway api-configs describe ${configId} --api=${apiId} --project=${projectId}`, { encoding: 'utf8' });
        return true;
    } catch (error) {
        return false;
    }
}

// Function to create or update the API Gateway
function createOrUpdateGateway(gatewayId, apiId, configId, projectId, location) {
    const gatewayExists = checkGatewayExists(gatewayId, projectId, location);

    if (gatewayExists) {
        // No need to update
        // console.log('Gateway exists. Updating...');
        // execSync(`gcloud api-gateway gateways update ${gatewayId} --api=${apiId} --api-config=${configId} --location=${location} --project=${projectId}`, { stdio: 'inherit' });
    } else {
        console.log('Gateway does not exist. Creating...');
        execSync(`gcloud api-gateway gateways create ${gatewayId} --api=${apiId} --api-config=${configId} --location=${location} --project=${projectId}`, { stdio: 'inherit' });
    }
}

// Main function
function main() {
    const projectId = (process.argv[2] || getGCPProjectID()).trim();

    // Generate OpenAPI spec
    const openAPISpec = createSwaggerSpec(projectId);
    fs.writeFileSync('gateway.yaml', openAPISpec, 'utf8');

    const apiId = 'gpt-cloud-api';
    const configId = 'gpt-cloud-config';
    const gatewayId = 'gpt-cloud-gateway';
    const location = 'us-central1';
    const userMember = gatewayId + '@' + projectId + '.iam.gserviceaccount.com';
    const serviceAccountUser = gatewayId + '-'+projectId+'-iam@' + projectId + '.iam.gserviceaccount.com';

    // Check if API config exists
    const apiConfigExists = checkAPIConfigExists(apiId, configId, projectId);

    if (!apiConfigExists) {
        // Create API config if it doesn't exist
        execSync(`gcloud api-gateway api-configs create ${configId} --api=${apiId} --openapi-spec=gateway.yaml --project=${projectId} --backend-auth-service-account=${serviceAccountUser}`, { stdio: 'inherit' });
    } else {
        console.log('API config already exists. Using existing config.');
    }

    // Create or update the API Gateway
    createOrUpdateGateway(gatewayId, apiId, configId, projectId, location);

    // Note: gcloud services enable <SERVICE ACCOUNT NAME>-.apigateway.PROJECTID.cloud.goog --project=PROJECTID in case of error
}

main();
