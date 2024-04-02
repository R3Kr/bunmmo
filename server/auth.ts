import {
  Lucia,
  type Adapter,
  type DatabaseSession,
  type DatabaseUser,
} from "lucia";

class InMemoryDBAdapter implements Adapter {
  readonly users: Map<string, DatabaseUser>;
  readonly sessions: Map<string, DatabaseSession> = new Map();

  constructor(
    users: Map<string, DatabaseUser>,
  ) {
    this.users = users;
  }

  async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const session = this.sessions.get(sessionId);
    const user = this.users.get(session?.userId ?? "");
    return [session ?? null, user ?? null];
  }
  async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const sessions = [];
    for (const session of this.sessions.values()) {
      session.userId === userId && sessions.push(session);
    }
    return sessions;
  }
  async setSession(session: DatabaseSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
  async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.expiresAt = expiresAt;
    }
  }
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
  async deleteUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      session.userId === userId && this.sessions.delete(session.id);
    }
  }
  async deleteExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.expiresAt.valueOf() < now) {
        this.sessions.delete(session.id);
      }
    }
  }
}


class DB extends Map<string, DatabaseUser  & {password: string}> {
  currUserGameId: number = 0
  createUser(key: string, password: string) {
    this.currUserGameId &= 0xffff
      this.set(key, {
        id: key,
        password: password,
        attributes: {
          gameId: this.currUserGameId++
        }
      })
  }
}

export const db = new DB()//new Map<string, DatabaseUser>()

export const lucia = new Lucia(new InMemoryDBAdapter(db), {
  getUserAttributes(databaseUserAttributes) {
      return {
        gameId: databaseUserAttributes.gameId
      }
  },
}
);

// IMPORTANT!
declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	gameId: number;
}
