use std::path::PathBuf;

fn main() {
    let schema = ccmux::graphql::build_schema(PathBuf::from("."));
    let sdl = schema.sdl_with_options(
        async_graphql::SDLExportOptions::new()
            .sorted_fields()
            .sorted_arguments()
            .sorted_enum_items(),
    );
    print!("{sdl}");
}
