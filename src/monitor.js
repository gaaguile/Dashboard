/*
$env:API_TOKEN = "cfut_m27tsAKae25HPFODmjNX7xfAeA7iWFmbiJhxi6QQ6d547939"                                    
$env:ACCOUNT_ID = "21bffc8441dc78c6dcd97b4d70a67b5f"
*/

const CF_API_TOKEN = "cfut_m27tsAKae25HPFODmjNX7xfAeA7iWFmbiJhxi6QQ6d547939";
const CF_ACCOUNT_ID = "21bffc8441dc78c6dcd97b4d70a67b5f";

const query = `{
  viewer {
    accounts(filter: { accountTag: "${CF_ACCOUNT_ID}" }) {
      pagesFunctionsInvocationsAdaptive(
        limit: 10000
        filter: {
          datetime_geq: "2026-06-01T00:00:00Z"
          datetime_leq: "2026-08-03T23:59:59Z"
        }
      ) {
        sum {
          requests
          errors
          subrequests
        }
        quantiles {
          cpuTimeP50
          cpuTimeP99
        }
      }
    }
  }
}`;

const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${CF_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const text = await response.text();
console.log("Raw:", text);
