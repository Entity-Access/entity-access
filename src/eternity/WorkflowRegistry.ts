const schema: Map<string,string[]> = new Map();

export const WorkflowRegistry = {
    register(target, key) {
        let methods = schema.get(target);
        if (!methods) {
            methods = [];
            schema.set(target, methods);
        }
        methods.push(key);
        return methods;
    }
};