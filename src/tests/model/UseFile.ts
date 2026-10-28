import Column from "../../decorators/Column.js";
import { RelateTo } from "../../decorators/Relate.js";
import Table from "../../decorators/Table.js";
import { User } from "./ShoppingContext.js";

@Table("UserFiles")
export class UserFile {

    @Column({ dataType: "BigInt", key: true, generated: "identity" })
    public fileID: number;

    @Column({ dataType: "BigInt"})
    @RelateTo({
        type: () => User,
        property: (uf) => uf.user,
        inverseProperty: (u) => u.files
    })
    public ownerID: number;

    public user: User;

    public photoUsers: User[];
    userFiles: UserFileBlock[];

}

@Table("UserFileBlocks")
export class UserFileBlock {

    @Column({ dataType: "BigInt", key: true })
    @RelateTo(UserFile, {
        property: (x) => x.file,
        inverseProperty: (x) => x.userFiles
    })
    fileID: number;

    @Column({ dataType: "Int", key: true})
    order: number;

    file: UserFile;

}