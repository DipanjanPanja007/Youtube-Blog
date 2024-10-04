import mongoose from "mongoose";
import { DB_NAME } from "../constants.js"

const connectDB = async () => { 
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log("MongoDB connected ... ");
        console.log(`\n DB host : ${connectionInstance.connection.host}\n`);
        
    } catch (error) {
        console.log("MongoDb connection-fail error: " , error);
        process.exit(1);
    }
}

export default connectDB;
