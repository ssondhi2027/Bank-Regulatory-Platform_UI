package api;

import io.restassured.RestAssured;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

public class FinancialMetricsApiTest {

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
        description = "Verify financial metrics endpoint"
    )
    public void verifyFinancialMetrics() {

        given()

        .when()
            .get("/metrics")

        .then()
            .statusCode(200)
            .contentType("application/json")
            .body("total_assets", notNullValue())
            .body("total_liabilities", notNullValue());
    }
}