package api;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

public class HealthApiTest {

    @BeforeClass
    public void setup() {

        RestAssured.baseURI =
                System.getProperty(
                        "api.base.url",
                        "https://YOUR-API-URL"
                );
    }

    @Test(
        groups = {"smoke", "api"},
        description = "Verify API health endpoint"
    )
    public void verifyHealthEndpoint() {

        given()

        .when()
            .get("/health")

        .then()
            .statusCode(200);
    }
}