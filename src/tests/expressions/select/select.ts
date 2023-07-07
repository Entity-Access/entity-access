import QueryCompiler from "../../../compiler/QueryCompiler.js";

type ICustomer = { firstName: string; lastName: string; emailAddress: string; birthDate: Date };

export default function() {

    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => ({ firstName, lastName}: ICustomer) => ({ name: `${firstName} ${lastName}`}));

}