import assert from "node:assert/strict";
import test from "node:test";
import { nearbyConversationPair, sampleConversation } from "../src/game/conversation-data";
import { SceneBridge } from "../src/game/scene-bridge";

test("only nearby distinct residents talk and the last pair gets a break", () => {
  const people = [ { id: "a", u: 0, v: 0 }, { id: "b", u: 0, v: 1 }, { id: "c", u: 8, v: 8 }, { id: "d", u: 8, v: 9.5 } ];
  assert.deepEqual(nearbyConversationPair(people)?.map(person => person.id), ["a", "b"]);
  assert.deepEqual(nearbyConversationPair(people, ["a", "b"])?.map(person => person.id), ["c", "d"]);
  assert.equal(nearbyConversationPair([people[0], people[2]]), undefined);
});

test("opening a cloud delivers its sample transcript without treating it as live evidence", () => {
  const bridge = new SceneBridge();
  const conversation = sampleConversation("policy", ["maya", "arjun"], 1);
  const received: unknown[] = [];
  bridge.setListeners({ onConversationStarted: value => received.push(value), onConversation: value => received.push(value) });
  bridge.conversationStarted(conversation);
  bridge.conversation(conversation);
  assert.deepEqual(received, [conversation, conversation]);
  assert.equal(conversation.kind, "sample");
  assert.deepEqual(conversation.messages.map(message => message.actorId), ["maya", "arjun", "maya", "arjun"]);
  assert.match(conversation.messages[3].text, /not a forecast/);
  assert.notEqual(conversation.title, sampleConversation("founder", ["maya", "arjun"], 2).title);
});
