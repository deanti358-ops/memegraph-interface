// One-time setup: create the Memegraph claims topic on Hedera testnet.
// Usage: OPERATOR_ID=0.0.x OPERATOR_KEY=0x... node scripts/create-topic.mjs
import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
} from "@hashgraph/sdk";

const operatorId = process.env.OPERATOR_ID;
const operatorKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

const tx = await new TopicCreateTransaction()
  .setTopicMemo("memegraph:claims:v1")
  // Submit key: only the Memegraph app can write claims (spam control);
  // everyone can read them via mirror node.
  .setSubmitKey(operatorKey.publicKey)
  .execute(client);

const receipt = await tx.getReceipt(client);
console.log(`Claims topic created: ${receipt.topicId.toString()}`);
client.close();
