// Role: README section 1 as a compiled example: connect, list agents, prompt one in a try, close.
// Informs HERDR-ADR-0014 (executable docs; the README region must equal this file once integration adds the markers) and plan 8.
import { connect, HerdrError } from '../src/index.ts';

const herdr = await connect(); // finds the socket (HERDR_SOCKET_PATH, else HERDR_SOCKET, else ~/.config/herdr/herdr.sock), pings, checks protocol 22

const { agents } = await herdr.agent.list({});
for (const agent of agents) console.log(agent.name, agent.agent_status);

try {
  await herdr.agent.prompt({ target: 'reviewer', text: 'run the tests' });
} catch (error) {
  if (error instanceof HerdrError) console.error(error.code, error.message);
  else throw error;
}

herdr.close();
