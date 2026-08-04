const CF_API_TOKEN = "cfut_m27tsAKae25HPFODmjNX7xfAeA7iWFmbiJhxi6QQ6d547939";

const response = await fetch(
  "https://api.cloudflare.com/client/v4/user/tokens/verify",
  { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } },
);

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
