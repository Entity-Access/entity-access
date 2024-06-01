export default interface ICheckConstraint<T = any> {
    name: string;
    filter?: (x: T) => boolean;
};