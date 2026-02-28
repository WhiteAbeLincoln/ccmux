mod graphql;
mod session;

use std::path::PathBuf;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    Extension,
    response::{Html, IntoResponse},
    routing::get,
};
use tower_http::cors::CorsLayer;

use graphql::AppSchema;

async fn graphql_handler(schema: Extension<AppSchema>, req: GraphQLRequest) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

async fn graphiql() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

#[tokio::main]
async fn main() {
    let home = std::env::var("HOME").expect("HOME not set");
    let base_path = PathBuf::from(format!("{home}/.claude/projects"));

    let schema = graphql::build_schema(base_path);

    let app = axum::Router::new()
        .route("/graphql", get(graphiql).post(graphql_handler))
        .layer(Extension(schema))
        .layer(CorsLayer::permissive());

    let addr = "127.0.0.1:3001";
    println!("Server running at http://{addr}");
    println!("GraphiQL playground at http://{addr}/graphql");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
