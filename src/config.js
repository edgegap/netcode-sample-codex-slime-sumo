// Matchmaker settings for Find Match: the API URL and the client Auth Token from the Edgegap
// dashboard (Matchmaker page). Matchmaker Auth Tokens are made for browser clients; never put an
// Edgegap API token here.
//
// Don't edit this file: put your values in src/config.local.js (git-ignored, same shape):
//   export default { url: 'https://<id>.edgegap.net', token: '<matchmaker-auth-token>' };
// The ?mm=<url>&token=<token> query parameters override both.
const local = Object.values(import.meta.glob('./config.local.js', { eager: true }))[0]?.default ?? {};
export const matchmakerConfig = { url: '', token: '', ...local };
