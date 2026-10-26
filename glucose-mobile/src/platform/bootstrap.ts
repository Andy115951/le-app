import { randomUUID } from "expo-crypto";
import { setIdFactory } from "../core/runtime";
setIdFactory(randomUUID);
