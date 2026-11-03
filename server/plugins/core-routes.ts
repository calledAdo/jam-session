import { createCoreRoutesPlugin } from "@agent-native/core/server";

// Allows authenticated REST creation of extensions (used to seed "Hat Energy").
export default createCoreRoutesPlugin({ extensionTools: true });
