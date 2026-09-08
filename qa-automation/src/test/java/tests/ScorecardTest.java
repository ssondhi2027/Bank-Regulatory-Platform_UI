package tests;

import base.BaseTest;
import org.testng.Assert;
import org.testng.annotations.Test;
import pages.ScorecardPage;

public class ScorecardTest extends BaseTest {

    @Test(
        groups = {"smoke", "regression"},
        description = "Verify scorecard authentication gate"
    )
    public void verifyScorecardAuthentication() {

        ScorecardPage scorecard =
                new ScorecardPage(driver);

        scorecard.open();

        Assert.assertTrue(
                scorecard.isPasswordGateDisplayed(),
                "Scorecard should require authentication"
        );
    }
}