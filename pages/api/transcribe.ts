import { Configuration, OpenAIApi } from "openai";
import { IncomingForm } from "formidable";
import fs from 'fs';
import path from 'path';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function transcript(fileName: any) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
    try {
      const path = `./mp3s/${fileName}.mp3`
      const resp = await openai.createTranscription(
        fs.createReadStream(path),
        "whisper-1"
        // Uncomment the line below if you would also like to capture filler words:
        // "Please include any filler words such as 'um', 'uh', 'er', or other disfluencies in the transcription. Make sure to also capitalize and punctuate properly."
      );

    const transcript = resp?.data?.text;
    // Content moderation check
    const response = await openai.createModeration({
      input: resp?.data?.text,
    });

    if (response?.data?.results[0]?.flagged) {
      return({ error: "Inappropriate content detected. Please try again." });
    }
    return({success:true, transcript });
  } catch (error) {
    console.error("server error");
    return({ error: error });
  }
}

export default async function handler(req: any, res: any) {
  // Here, we create a temporary file to store the audio file using Vercel's tmp directory
  // As we compressed the file and are limiting recordings to 2.5 minutes, we won't run into trouble with storage capacity
  // const fData = await new Promise<{ fields: any; files: any }>(
  //   (resolve, reject) => {
  //     const form = new IncomingForm({
  //       multiples: false,
  //       uploadDir: "/tmp",
  //       keepExtensions: true,
  //     });
  //     form.parse(req, (err, fields, files) => {
  //       if (err) return reject(err);
  //       resolve({ fields, files });
  //     });
  //   }
  // );

  // const videoFile = fData.files.file;
  // const videoFilePath = videoFile?.filepath;

  const upload = multer({ dest: './mp3s' });
  if (req.method === 'POST') {
    try {
      // Handle file upload using multer middleware
      upload.single('file')(req, res, async function (err: any) {
        if (err instanceof multer.MulterError) {
          // A Multer error occurred
          return res.status(400).json({ error: 'File upload error' });
        } else if (err) {
          // An unknown error occurred
          return res.status(500).json({ error: err, msg:'MulterError' });
        }

        // File upload successful
        const fileName = req.file.filename;

        // Rename and move the uploaded file to the desired directory
        const oldFilePath = path.join('./mp3s', fileName);
        const newFilePath = path.join('./mp3s', `${fileName}.mp3`);

        fs.renameSync(oldFilePath, newFilePath);
        const result = await transcript(fileName)
        if(result.error){
          return res.status(500).json({ error: result.error, msg: 'Internal server error' });
        } else {
          return res.status(200).json({ transcript: result.transcript });
        }
      });
    } catch (error) {
      console.error('Error uploading file:');
      return res.status(500).json({ error:error, msg: 'Internal server error' });
    }
  } else {
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
  }

}
