import assert from "assert";
import QueryCompiler from "../../../compiler/QueryCompiler.js";

type ICustomer = { firstName: string; lastName: string; emailAddress: string; birthDate: Date };

export default function() {


    const compiler = QueryCompiler.instance;

    const name = "Akash";

    let r = compiler.execute({ name }, (p) => ({ firstName, lastName, emailAddress }: ICustomer) => ({ emailAddress, name: `${firstName} ${lastName}` }));

    assert.strictEqual(`FROM ("x1"."emailAddress" AS "emailAddress",CONCAT("x1"."firstName",' ',"x1"."lastName") AS "name")`, r.text);

    r = compiler.execute({ name }, (p) => ({ id }) => ({ error: `${id > 0 ? "Error" : ""}` }));

    assert.strictEqual(`FROM (CONCAT((CASE WHEN "x1"."id" > 0 THEN 'Error' ELSE '' END)) AS "error")`, r.text);

}