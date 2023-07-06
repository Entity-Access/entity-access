import ServiceCollection from "./ServiceCollection.js";

export default function DIScoped(target) {
    ServiceCollection.register("Scoped", target);
}