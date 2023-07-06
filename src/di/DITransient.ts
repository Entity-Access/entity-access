import ServiceCollection from "./ServiceCollection.js";

export default function DITransient(target) {
    ServiceCollection.register("Transient", target);
}