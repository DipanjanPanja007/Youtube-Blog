import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"



const registerUser = asyncHandler( async (req, res) => {
    /*
     * Step#1: get user details from frontend
     * Step#2: validation - not empty
     * Step#3: check if uer already exists : username, email
     * Step#4: check for images, check for avatar
     * Step#5: upload them on cloudnary, avatar 
     * Step#6: create user object - create entry in db
     * Step#7: remove password and refresh token field from response
     * Step#8: check for user creation 
     * Step#9: return response 
     */

    // Step#1: get user details from frontend  ( text data->from body, images->from multer-middleware-fields)
    // console.log(`printing request: ${JSON.stringify(req.body)}`);               // testing

    const { fullName, email, username, password } =  req.body;

    // Step#2: validation - not empty
    if(  [fullName, email, username, password].some((field) => field?.trim() === "")  ){
        throw new ApiError(400, "All fields are required...");
    }

    // Step#3: check if uer already exists : username, email
    const existedUser = await User.findOne({
        $or: [ { username }, { email } ]
    })
    if(existedUser){
        throw new ApiError(409 , "User with same Username or email already exists ")
    }

    // Step#4: check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    let coverImageLocalPath ="";
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){         // check if user provided coverImage or not
        coverImageLocalPath = req.files.coverImage[0]?.path;
    }


    
    // Step#5: upload them on cloudnary, avatar 
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);             //******
    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    // Step#6: create user object - create entry in db
    const user = await User.create({
        fullName,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password,
        username: username.toLowerCase(),
    });


    // Step#7: remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(                      // select takes a string, "-" sign means here except
        "-password -refreshToken"
    )

    // Step#8: check for user creation 
    if(!createdUser){
        throw new ApiError(500, "Something is wrong while registering you...")
    }

    // Step#9: return response 
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

});

export {registerUser}