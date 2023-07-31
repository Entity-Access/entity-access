import { IClassOf } from "../decorators/IClassOf.js";
import type Workflow from "./Workflow.js";

export interface IWorkflowSchema {
    name: string;
    type: IClassOf<Workflow>;
    activities: string[];
    uniqueActivities: string[];
}

// const schema: Map<any,IWorkflowSchema> = new Map();
const schemaByName: Map<string,IWorkflowSchema> = new Map();

export const WorkflowRegistry = {
    register(target: IClassOf<any>, key, unique = false) {
        let methods = schemaByName.get(target.name);
        if (!methods) {
            methods = { name: target.name, type: target, activities: [], uniqueActivities: [] };
            schemaByName.set(target.name, methods);
        }
        if (unique) {
            methods.uniqueActivities.push(key);
        } else {
            methods.activities.push(key);
        }
        return methods;
    },

    getByName(name: string) {
        return schemaByName.get(name);
    }
};