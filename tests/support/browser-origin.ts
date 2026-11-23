const port = process.env.MITSA_E2E_PORT ?? "3000";
if (!/^(3000|3001)$/.test(port)) throw new Error("Browser tests require an approved loopback port");
export const browserPort = port;
export const browserOrigin = `http://127.0.0.1:${port}`;
