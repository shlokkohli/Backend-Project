import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { connect } from "mongoose"

dotenv.config({
    path: './env'
})

connectDB();