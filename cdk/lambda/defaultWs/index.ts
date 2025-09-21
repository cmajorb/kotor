
export const handler = async (event: any) => {
  // event.body contains JSON from client
  const body = event.body ? JSON.parse(event.body) : {};
  // Echo for now
  console.log('ws message', body);
  return { statusCode: 200, body: 'ok' };
};
