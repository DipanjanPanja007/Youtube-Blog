import { v2 as cloudinary } from "cloudinary";
import fs from "fs"


// Configuration of cloudinary
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async (localFilePath , avatarURL) => {

    try {             // trying to delete old image, not working
        if(avatarURL){
            cloudinary.uploader.destroy(avatarURL, (error, result) => {
                if (result) {
                    console.log('Image deleted:', result);
                } else {
                    console.error('Error deleting image:', error);                    
                }
            })

        }
    } catch (error) {
        console.log("User not found error", error);        
    }

    try {
        if(!localFilePath){
            return null;
        }
        // upload file on Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file uploaded successfully
        // console.log("file uploaded successfully", response.url);
        fs.unlinkSync(localFilePath)

        // console.log(response);
        return response;       

    } catch (error) {
        fs.unlinkSync(localFilePath)                  // remove the locally saved temp file if upload fails
        return null;
    }
}


export { uploadOnCloudinary }