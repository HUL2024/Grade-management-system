import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 },
        );
      }

      try {
        // Only allow calls using the secret/server-to-server mode
        if (ctx.authMode !== "secret") {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
        }

        const { user_id, new_phone } = await req.json();

        if (!user_id || !new_phone) {
          return Response.json(
            {
              error: "user_id and new_phone are required",
            },
            { status: 400 },
          );
        }

        // Validate the Liberian phone format
        if (!/^077\d{7}$/.test(new_phone)) {
          return Response.json(
            {
              error: "Invalid phone number format",
            },
            { status: 400 },
          );
        }

        const newEmail =
          `${new_phone}@teacher.ajbleadersacademy.internal`;

        const { data, error } =
          await ctx.supabaseAdmin.auth.admin.updateUserById(
            user_id,
            {
              email: newEmail,
              user_metadata: {
                phone: new_phone,
              },
            },
          );

        if (error) {
          return Response.json(
            { error: error.message },
            { status: 400 },
          );
        }

        return Response.json({
          success: true,
          user_id: data.user.id,
          email: data.user.email,
          phone: data.user.user_metadata?.phone,
        });
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error
              ? error.message
              : "Unknown error",
          },
          { status: 500 },
        );
      }
    },
  ),
};