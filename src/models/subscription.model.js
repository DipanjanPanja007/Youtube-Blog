import mongoose, {Schema} from "mongoose"

const subscriptionSchema = new Schema(
    {
        subscriber: {
            type: Schema.Types.ObjectId,              // who is Subscribing
            ref: "User"
        },
        channel: {
            type: Schema.Types.ObjectId,              // to whom is Subscribing
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)


export const Subscription = mongoose.model("Subscription" , subscriptionSchema );