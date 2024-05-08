
export async function delay(pollingInterval: number) {
    return new Promise(resolve => setTimeout(resolve, pollingInterval));
}

