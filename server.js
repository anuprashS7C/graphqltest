const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_API_URL = process.env.SHOPIFY_API_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;


app.post("/update-customer", async (req, res) => {
    try {
        const { customerId, firstName, lastName, phone, dateOfBirth } = req.body;
        console.log("Received request for customer:", customerId, firstName, lastName);

        const checkCustomerQuery = `
        query getCustomer($id: ID!) {
            customer(id: $id) {
                id
            }
        }`;

        const checkResponse = await axios.post(
            SHOPIFY_API_URL,
            { query: checkCustomerQuery, variables: { id: `gid://shopify/Customer/${customerId}` } },
            {
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!checkResponse.data.data.customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const updateQuery = `
        mutation updateCustomer($input: CustomerInput!) {
            customerUpdate(input: $input) {
                customer {
                    id
                    firstName
                    lastName
                    phone
                    metafield(namespace: "custom", key: "date_of_birth") {
                        value
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }`;

        const formattedDate = dateOfBirth && dateOfBirth.trim() !== "" ? dateOfBirth : null;
        const variables = {
            input: {
                id: `gid://shopify/Customer/${customerId}`,
                firstName,
                lastName,
                ...(phone ? { phone } : {}),
                ...(formattedDate
                    ? {
                          metafields: [
                              {
                                  namespace: "custom",
                                  key: "date_of_birth",
                                  type: "date",
                                  value: formattedDate,
                              },
                          ],
                      }
                    : {}),
            },
        };

        const response = await axios.post(
            SHOPIFY_API_URL,
            { query: updateQuery, variables },
            {
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.data.errors) {
            return res.status(400).json({ error: response.data.errors });
        }

        const { customerUpdate } = response.data.data;
        if (customerUpdate.userErrors.length > 0) {
            return res.status(400).json({ errors: customerUpdate.userErrors });
        }

        res.json({ success: true, customer: customerUpdate.customer });

    } catch (error) {
        console.error("Error updating customer:", error.response?.data || error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
