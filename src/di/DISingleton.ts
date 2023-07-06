import ServiceCollection from "./ServiceCollection.js";

export default function DISingleton(target) {
    ServiceCollection.register("Singleton", target);
}