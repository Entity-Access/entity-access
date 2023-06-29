import EntityContext from "../../model/EntityContext.js";

export default abstract class AutomaticMigrations {

    abstract apply(model: EntityContext);

}
