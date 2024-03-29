const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


const port = process.env.PORT || 5000
//user doctor-admin 
//PASS hKUvKLKgc9J1Ul5s

//middle position
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2imv8.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function veryfyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthroizaied' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'ForBidden' })
        }
        req.decoded = decoded;
        next();
    });


}
async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors-portal').collection('services')
        const bookingCollection = client.db('doctors-portal').collection('bookings')
        const userCollection = client.db('doctors-portal').collection('users')

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray()
            res.send(services)
        })
        app.get('/user', veryfyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })


        app.put('/user/admin/:email', veryfyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })
        //Warning
        //this is not the proper way to query
        //agter learning more about mongodb use agrre lokeup,pipeline,match,group
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            ///step-1 get all sevices
            const services = await serviceCollection.find().toArray()

            //step-2
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()
            //step-3
            services.forEach(service => {
                //step-4 find bookings for thsts service
                const serviceBookings = bookings.filter(book => book.treatment === service.name)
                //step-5 select slots for the service bookings
                const bookedSlots = serviceBookings.map(book => book.slot)
                //step-6 select those slots that are not bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                //step-7 set available to make to slots it easier
                service.slots = available
                // service.booked = serviceBookings.map(s => s.slot)

            })
            res.send(services)
        })
        // app.get('/booking') get all booking in this collection or get more than one by filter
        // app.get('/booking/:_id') get a specific booking
        // app.post('/booking') add a new booking
        // app.patch('/booking/_id') specifin update one data
        // app.delete('/booking/:id') specific delete one data

        app.get('/booking', veryfyJWT, async (req, res) => {
            const patient = req.query.patient
            const decodedEmail = req.decoded.email
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                return res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'ForBidden' })
            }

        })
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query)
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result })
        })

    }
    finally {

    }

}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello From doctors-portal')
})
app.get('/hero', (req, res) => {
    res.send('hero from hero ku')
})

app.listen(port, () => {
    console.log(`doctors-portal app listening ${port}`)
})