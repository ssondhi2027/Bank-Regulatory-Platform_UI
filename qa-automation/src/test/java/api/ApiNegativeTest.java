package api;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.*;

public class ApiNegativeTest {

    @BeforeClass
    public void setup() {

        RestAssured.baseURI =
                System.getProperty(
                        "api.base.url",
                        "https://YOUR-API-URL"
                );
    }

    @Test(
        groups = {"regression", "api"},
        description = "Verify invalid endpoint handling"
    )
    public void verifyInvalidEndpoint() {

        given()

        .when()
            .get("/invalid-endpoint")

        .then()
            .statusCode(
                org.hamcrest.Matchers.anyOf(
                    org.hamcrest.Matchers.is(404),
                    org.hamcrest.Matchers.is(400)
                )
            );
    }
}