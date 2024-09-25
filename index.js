const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { randomBytes } = require('crypto');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware cors
app.use(cors());

app.use(express.json());

app.use(cookieParser());
console.log(path.join(__dirname, 'frontendfashion/build'));


app.use(express.static(path.join(__dirname, 'frontendfashion/build')));

// Database Connection from mongodb
mongoose
  .connect(process.env.DBHOST)
  .then(() => console.log("Connection success"))
  .catch((err) => console.log(`No connection ${err}`));

// Nodemailer Transporter Configuration form
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnAuthorized: true
  }
});


// User Schema for registration and login
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Name is required"],
    set: function (value) {
      return value ? value.trim() : ''; // Handle undefined values
    }
  },

  email: String,
  password: String,

  verified: {
    type: Boolean,
    default: false

  },

  verificationToken: {
    type: String,
    required: false, 
    
  },
  createdAt: {
    type: Date,
    default: Date.now,
   
  }
});

const User = mongoose.model('users', userSchema);

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  console.log('Register Request Body:', req.body);
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });

    // If user already exists, send an error response
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Generate a new verification token only if the user doesn't exist
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Create a new user instance with hashed password and verification token
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      verified: false

    });

    // Save the new user to the database
    await newUser.save();

    // Construct the verification link with the correct frontend URL and the generated verification token
    const verificationLink = `https://glamourgroove.onrender.com/${verificationToken}`;

    // Send the verification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email Address',
      html: `<p>Hello ${username},</p>
             <p>Please click <a href="${verificationLink}">here</a> to verify your email address.</p>
             <p>Thank you.</p>`
    });

    console.log("Registration email sent successfully");

    // Respond with success message
    res.json({
      message: "Registration successful! Please check your email for verification.",
      verified: false,
      username: newUser.username
    });

  } catch (err) {
    console.error("Error during registration:", JSON.stringify(err, null, 2)); 
    res.status(500).json({ error: "Internal Server Error" });
  }
});




app.get('/verify/:token', async (req, res) => {
  const token = req.params.token;
  console.log("Token: ", token)

  try {
    // Find user by verification token
    const user = await User.findOneAndUpdate(
      { verificationToken: token },
      { $set: { verified: true, verificationToken: undefined } },
      { new: true }
    );

    if (!user) {
      return res.status(404).send('Invalid or expired token');
    }
    const loginUrl = 'https://frontendfashion.vercel.app/login';

    res.send(`Email verified successfully. Go back to the website and <a href="${loginUrl}">login</a> with your credentials.`);


  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});










//User Login Apis
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('Received Login Request:', { email, password });

  try {
    // Find user by email
    const dbUser = await User.findOne({ email });

    // Check if the user exists
    if (!dbUser) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!dbUser.verified) {
      return res.status(400).json({ error: "User not verified" });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordMatched = await bcrypt.compare(password.trim(), dbUser.password.trim());

    // Check if passwords match
    if (isPasswordMatched) {
      const payload = {
        email: dbUser.email, // Use the email from the database
      };
      const jwtToken = jwt.sign(payload, process.env.JWT_TOKEN);
      res.send({ jwtToken, verified: dbUser.verified });
    } else {
      console.log('Invalid Password:', { email });
      res.status(400).json({ error_msg: "Invalid credentials" });
    }

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error_msg: 'Internal server error' });
  }
});

//Add Product Apis
const cardSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true }
});

const Card = mongoose.model('Cards', cardSchema);

app.post('/add', async (req, res) => {
  const { image_url, title, description } = req.body;
  const newProduct = new Card({
    image_url,
    title,
    description
  })
  let result = await newProduct.save()

  res.send(result)
})

app.get('/addproducts', async (req, res) => {
  try {
    // Retrieve all products from the database
    const products = await Card.find();

    // Send the products as a JSON response
    res.json(products);
  } catch (error) {
    console.error('Error fetching products from the database:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const productSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  price: Number,
  subTitle: String,
  rating: String,
  categoryid: String,
  availability: String,
});

const Product = mongoose.model('Product', productSchema);

app.post("/products", async (req, res) => {
  const { title, image_url, description, price, subTitle, rating, categoryid, availability } = req.body;

  const newProduct = new Product({
    title,
    image_url,
    description,
    subTitle,
    rating,
    categoryid,
    availability,
    price
  });

  // Save the new product to the database
  try {
    const savedProduct = await newProduct.save();

    // Find similar products based on category ID
    const similarProducts = await Product.find({ categoryid: categoryid });

    res.status(200).json({
      message: "Product added successfully",
      newProduct: savedProduct,
      similarProducts: similarProducts
    });
  } catch (error) {
    res.status(500).json({ error: "Error saving product to database" });
  }
});

app.get("/products", async (req, res) => {
  const { title, image_url, subTitle, categoryid, } = req.query;

  try {
    let query = {};

    // Check if title and/or image_url are provided in the query parameters
    if (title) {
      query.title = title;
    }

    if (image_url) {
      query.image_url = image_url;
    }

    // Check if subTitle contains the word "Lipstick"
    if (subTitle) {
      query.subTitle = { $regex: new RegExp(subTitle, 'i') };
    }

    if (categoryid) {
      query.categoryid = categoryid
    }

    const products = await Product.find(query).select(' _id image_url title subTitle categoryid');

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    // Find the product by its ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Find similar products based on the category ID of the product
    const similarProducts = await Product.find({ categoryid: product.categoryid });

    // Exclude the current product from the list of similar products
    const filteredSimilarProducts = similarProducts.filter(function (similarProduct) {
      // Only include products whose ID is not equal to the ID of the current product
      return similarProduct._id.toString() !== productId;
    });

    const simplifiedSimilarProducts = filteredSimilarProducts.map(function (similarProduct) {
      // Create a new object containing only the required properties
      return {
        id: similarProduct._id,
        image_url: similarProduct.image_url,
        title: similarProduct.title,
        price: similarProduct.price
      };
    });

    const response = {
      id: product._id,
      image_url: product.image_url,
      title: product.title,
      price: product.price,
      subTitle: product.subTitle,
      description: product.description,
      rating: product.rating,
      availability: product.availability,
      similar_products: simplifiedSimilarProducts
    };

    res.json(response)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const ContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    validate: {
      validator: function (value) {
        // Check if the name contains only alphabets
        return /^[a-zA-Z\s]+$/.test(value);
      },
      message: "Name should only contain alphabets",
    },
    set: function (value) {
      // Remove leading and trailing whitespace
      return value.trim();
    },
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    validate: {
      validator: function (value) {
        // Email validation using a regular expression
        return /^[a-zA-Z0-9._-]+@gmail\.com$/.test(value);
      },
      message: "Invalid email format. Please use a valid Gmail address.",
    },
  },
  message: {
    type: String,
    required: [true, "Message is required"],
  },
});

const Contact = mongoose.model('contacts', ContactSchema);

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    // Check if required fields are provided
    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newContact = new Contact({
      name,
      email,
      message,
    });

    const result = await newContact.save();
    res.send(result);
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError' || error.errors.email) {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: errors });
    }
    // Handle other errors
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontendfashion/build', 'index.html'));
});

app.listen(port, () => console.log(`Server running at https://my-fashion-j4fcv8i2s-alishakhan897s-projects.vercel.app:${port}`));
