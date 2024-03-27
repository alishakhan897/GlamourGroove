const express = require('express');    // Install Express in your package.json file and import here 
const mongoose = require('mongoose');   // Same as Express
const cors = require('cors');           // **
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config()
const port = process.env.PORT || 3000;  // env : This provide you an available port number in your environment

const app = express();
app.use(cors());

app.use(express.json());

mongoose.connect(process.env.DBHOST)
  .then(() => {
    console.log("Connection success");

  })
  .catch((err) => console.log(`No connection ${err}`));


//User Registered Api
// userSchema Defining Details what we want in out database 
const userSchema = new mongoose.Schema({
  username:{
    type:String,
    required: [true, "Name is required"],
    set: function (value) {
      // Remove leading and trailing whitespace
      return value.trim();
    },
  },
  email: String,
  password: String
});
const User = mongoose.model('users', userSchema); // Model: your database Collection Name


// Posting user details to Server Side using postMethod
app.post('/register', async (req, res) => {   //register: http://localhost:3000/register
  const { username, email, password } = req.body;
  try {
      // Check if the email already exists
      const userExist = await User.findOne({ email });
      if (userExist) {
          return res.status(422).json({ error: "Email Already Exist" });
      }

      // Hash the password
      let hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user with the hashed password
      const newUser = new User({
          username,
          email,
          password: hashedPassword,
      });

      // Save the user to the database
      await newUser.save();

      console.log("User saved successfully");
      res.json({ message: "Registration successful!" });
  } catch (err) {
      console.log("Error saving user:", err);
      res.status(500).json({ error: "Internal Server Error" });
  }
});



app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('Received Login Request:', { email, password });

  try {
    // Find user by username
    const dbUser = await User.findOne({ email });

    // Check if the user exists
    if (!dbUser) {
      console.log('Invalid User:', { email, password });
      return res.status(400).json({ error: "Invalid User" });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordMatched = await bcrypt.compare(password.trim(), dbUser.password.trim());
    console.log('bcrypt.compare Result:', isPasswordMatched);

    // Check if passwords match
    if (isPasswordMatched) {
      const payload = {
        email: email,
      };
      const jwtToken = jwt.sign(payload, process.env.JWT_TOKEN);
      res.send({ jwtToken });
    } else {
      console.log('Invalid Password:', { username, password });
      res.status(400).json({ error_msg: "Invalid Password" });
    }
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error_msg: 'Internal server error' });
  }
});

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
  subTitle:String,
  rating:String,
  categoryid:String,
  availability:String,
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
  const { title, image_url, subTitle ,   categoryid, } = req.query;

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
    const filteredSimilarProducts = similarProducts.filter(function(similarProduct) {
      // Only include products whose ID is not equal to the ID of the current product
      return similarProduct._id.toString() !== productId;
    });
     
    const simplifiedSimilarProducts = filteredSimilarProducts.map(function(similarProduct) {
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
      subTitle:product.subTitle,
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

app.use(express.static(path.join(__dirname, 'frontendfashion/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontendfashion/build', 'index.html'));
});

app.listen(port, () => console.log(`Server running at https://my-fashion-j4fcv8i2s-alishakhan897s-projects.vercel.app:${port}`))

