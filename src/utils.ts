import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

export const delay = async (pollingInterval: number) => {
    return new Promise(resolve => setTimeout(resolve, pollingInterval));
};

/**
 *
 * @description Access to a secret stored in GCP Secret Manager (https://console.cloud.google.com/security/secret-manager/)
 * @param name - Secret name we can refer in Google Cloud Secret Manager
 * Examples:
 *  - projects/0020090084006/secrets/OPENAI_API_KEY
 *  - projects/0020090084006/secrets/OPENAI_API_KEY/versions/latest
 */
export const getOpenApiSecret = async (name = 'OPENAI_API_KEY') => {
    const client = new SecretManagerServiceClient();

    if (!name.includes('/versions/')) {
        name += '/versions/latest';
    }

    const [version] = await client.accessSecretVersion({
        name: name,
    });

    if (version.payload && version.payload.data) {
        console.log('Secret received from store');
        return version.payload.data.toString();
    }

    return null;
};
