import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user/model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {

  // Step 1: Get user details from frontend
  const { fullname, email, username, password } = req.body;
  console.log("Email: ", email);
  

  // Step 2: Check if any of the fields are empty or not
  if(fullname === ""){
    throw new ApiError(400, "All fields are required");
  }
  if(email == ""){
    throw new Error(400, "All fields are required"); 
  }
  if(username == ""){
    throw new Error(400, "All fields are required");
  }
  if(password == ""){
    throw new Error(400, "All fields are required");
  }


  // Step 3: Checking if there is any duplicate user or not using the username and email
  const existedUser = User.findOne({
    $or: [{ username }, { email }]
  })

  if(existedUser){
    throw new ApiError(409, "User with email or username already exists")
  }


  // Step 4: Check if avatar and profile picture is there or not

  // req.files is given by multer, this gives a detailed brief about the uploaded file such as file name, path, size etc
  // we are checking that in the all the files, if there is something named as avatar, if YES then =>
  // then select the filepath from of that avatar (if it is available)
  const avatarLocalPath = req.files?.avatar[0]?.path;

  // local path for cover Image
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
  }

  // upload the image to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // check again that if the avatar has been upload properly to cloudinary or not
  if(!avatar){
    throw new ApiError(400, "Avatar file is required")
  }


  // Step 5: if everything has been sent by the user properly so far, then take all of those values and create an entry in the db
  const user = await User.create({
    fullname: fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email: email,
    password: password,
    username: username.toLowerCase()
  })

  const createdUser = await user.findById(user._id).select("-password -refreshToken")

  if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  // Step 6: Send final response
  return res.status(200).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
  )


});

export { registerUser };