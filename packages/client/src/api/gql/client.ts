// postgraphile initialization
import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloClient } from "apollo-client";
import { ApolloLink } from "apollo-link";
import { setContext } from "apollo-link-context";
import {onError} from "apollo-link-error";
import { HttpLink } from "apollo-link-http";
import { createUploadLink } from "apollo-upload-client";

const authLink = new ApolloLink((operation, forward) => {

    operation.setContext(({headers, ...other}) => {
        const token = localStorage.getItem("token");
        if (token) {
            return {
                headers: {
                    ...headers,
                    Authorization: `Bearer ${token}`,
                },
                ...other,
            };
        } else {
            return {headers, ...other};

        }

    });

    return forward!(operation).map((data) => {
        const headers = operation.getContext().response.headers;
        const auth = headers.get("Authorization");
        if (auth) {
            const parts = auth.split(" ");
            if (parts[0] !== "Bearer") {
                console.log(`Invalid 'Authorization' header: ${auth}`);
                return data;
            }
            localStorage.setItem("token", parts[1]);
        }
        return data;
    });

});

//todo figure out why TS keeps fucking me
const cache: InMemoryCache = new InMemoryCache({
    cacheRedirects: {
        Query: {
            productById: (_, args, { getCacheKey }) => {
                return getCacheKey({ __typename: 'Product', id: args.id })
            }
        },
    },
});
console.log(process.env.NODE_ENV === "production");

const client = new ApolloClient({

    // TODO need to move this to separate file
    link: ApolloLink.from([
        authLink,
        createUploadLink({uri: process.env.NODE_ENV === "production" ? "https://shakeonthis.com/gql" : "https://localhost:3002/gql"}),
        onError(
            ({ operation, response, graphQLErrors, networkError, forward }) => {
                if (graphQLErrors) {
                    console.log(graphQLErrors);
                    graphQLErrors.map(({ message, locations, path }) =>
                        console.log(
                            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
                        ),
                    );
                }
                if (networkError) {
                    console.log(response);
                    console.log(operation);
                    console.log(networkError);
                    operation.setContext({
                        errorPolicy: "none",
                    });
                    return null;
                }
            },
        ),
        new HttpLink({
            uri: process.env.NODE_ENV === "production" ? "https://shakeonthis.com/gql" : "https://localhost:3002/gql",
            credentials: "include",
        }),
    ]),
    cache,

});

export default client;
