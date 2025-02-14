import Inject, { RegisterSingleton, ServiceProvider } from "../../di/di.js";

const services = new ServiceProvider();

@RegisterSingleton
class Root {

    public root = "root";
}

@RegisterSingleton
class Branch {

    @Inject branchRoot: Root;

    public branch = "branch";
}

@RegisterSingleton
class Leaf {
    @Inject branch: Branch;

    leaf: string;

    constructor() {
        this.leaf = this.branch.branchRoot.root + " -> "  +this.branch.branch + " -> leaf";
    }
}

export default function() {
    const leaf = services.resolve(Leaf);
    console.log(leaf.leaf);
}



