{
  "operationName": "Proposals",
  "variables": {
    "first": 1,
    "space": "gnosis.eth",
    "state": "all",
    "author_in": []
  },
  "query": "query Proposals($first: Int!, $state: String!, $space: String) { proposals( first: $first where: {space: $space, state: $state} ) { ipfs } }"
}