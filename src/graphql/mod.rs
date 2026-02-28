pub mod query;
pub mod types;

use async_graphql::{EmptyMutation, EmptySubscription, Schema};

use self::query::Query;

pub type AppSchema = Schema<Query, EmptyMutation, EmptySubscription>;

pub fn build_schema(base_path: std::path::PathBuf) -> AppSchema {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .data(base_path)
        .finish()
}
